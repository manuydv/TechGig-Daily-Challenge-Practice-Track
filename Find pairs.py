For this challenge, you need to take array and an integer as an input, check for pair in array with sum as that of an integer and if you find those two numbers in the array return true else return false. 

Input Format
You need to take an integer input on first line which tells about the size of the array.Another line will have array elements separated by spaces. Last line will have an integer input that defines the number for which the pair has to be searched in the array. 

Constraints
1 < n < 10^5
1 < A[i] < 10^5

Output Format
Print 'True' if the pair found in the array element else print 'False' to the stdout. 

Sample TestCase 1

Input
7
33 12 -76 11 9 7 6
20

N = list(map(int, input().split()))[0]
array = list(map(int, input().split()))
integer = list(map(int, input().split()))[0]

pair = 0
one = two = 0
for i in range(N):
    for j in range(N):
        pair = array[i] + array[j]
        if pair == integer:
            one = array[i]
            two = array[j]
            break
    if pair == integer:
        break
         
if(one != 0 and two != 0):
    print('True', end = "")
else:
    print('False', end = "")
