For this challenge, you need to take number of elements as input on one line and array elements as an input on another line and find the second largest array element and print that element to the stdout. 

Input Format
In this challenge, you will take number of elements as input on one line and array elements which are space separated as input on another line. 

Constraints
1 < = n < = 100000
1 < = a[i] < = 10^9

Output Format
You will print the second largest element to the stdout.

def main():

 n = input()
 array = input().split(" ")
 array = map(int, array)

 array1 = []
 for i in array:
     array1.append(int(i))
 second_last = sorted(array1)[-2]

 print(second_last, end = "")


main()
